#include "CBTownBuilder.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/SceneComponent.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInterface.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Math/RandomStream.h"
#include "UObject/ConstructorHelpers.h"

// Engine basic shapes are 100 cm across, with the pivot at the centre.
static constexpr float ShapeSize = 100.f;
static const FName ColorParam(TEXT("Color"));

ACBTownBuilder::ACBTownBuilder()
{
	PrimaryActorTick.bCanEverTick = false;
	SetRootComponent(CreateDefaultSubobject<USceneComponent>(TEXT("Root")));

	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cylinder(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> Mat(TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	CubeMesh = Cube.Object;
	CylinderMesh = Cylinder.Object;
	BaseMaterial = Mat.Object;
}

bool ACBTownBuilder::IsRoad(int32 X, int32 Y) const
{
	return (X % BlockEvery == 0) || (Y % BlockEvery == 0);
}

FVector ACBTownBuilder::TileCenter(int32 X, int32 Y) const
{
	const float Half = GridSize * TileSize * 0.5f;
	return FVector(X * TileSize + TileSize * 0.5f - Half, Y * TileSize + TileSize * 0.5f - Half, 0.f);
}

UInstancedStaticMeshComponent* ACBTownBuilder::MakeISM(const TCHAR* Name, UStaticMesh* Mesh, const FLinearColor& Color, UMaterialInstanceDynamic** OutMID)
{
	UInstancedStaticMeshComponent* ISM = NewObject<UInstancedStaticMeshComponent>(this, FName(Name));
	ISM->SetMobility(EComponentMobility::Movable);
	ISM->SetStaticMesh(Mesh);
	ISM->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	ISM->SetupAttachment(GetRootComponent());
	if (BaseMaterial)
	{
		UMaterialInstanceDynamic* MID = UMaterialInstanceDynamic::Create(BaseMaterial, this);
		MID->SetVectorParameterValue(ColorParam, Color);
		ISM->SetMaterial(0, MID);
		if (OutMID) { *OutMID = MID; }
	}
	ISM->RegisterComponent();
	AddInstanceComponent(ISM);
	return ISM;
}

UPointLightComponent* ACBTownBuilder::MakeLight(const FVector& Loc, const FLinearColor& Color, float Radius)
{
	UPointLightComponent* L = NewObject<UPointLightComponent>(this);
	L->SetMobility(EComponentMobility::Movable);
	L->SetupAttachment(GetRootComponent());
	L->SetRelativeLocation(Loc);
	L->SetIntensityUnits(ELightUnits::Candelas);
	L->SetIntensity(0.f);
	L->SetLightColor(Color);
	L->SetAttenuationRadius(Radius);
	L->SetCastShadows(false);
	L->RegisterComponent();
	AddInstanceComponent(L);
	return L;
}

void ACBTownBuilder::BeginPlay()
{
	Super::BeginPlay();
	if (!CubeMesh || !CylinderMesh) { return; }

	const float MapSize = GridSize * TileSize;
	FRandomStream Rng(Seed);

	// --- Ground ---
	UInstancedStaticMeshComponent* Ground = MakeISM(TEXT("Ground"), CubeMesh, FLinearColor(0.11f, 0.20f, 0.07f));
	Ground->AddInstance(FTransform(FRotator::ZeroRotator, FVector(0, 0, -50.f), FVector((MapSize + 4000.f) / ShapeSize, (MapSize + 4000.f) / ShapeSize, 1.f)));

	// --- Roads, sidewalks, lane marks ---
	UInstancedStaticMeshComponent* Roads = MakeISM(TEXT("Roads"), CubeMesh, FLinearColor(0.035f, 0.035f, 0.04f));
	UInstancedStaticMeshComponent* Walks = MakeISM(TEXT("Sidewalks"), CubeMesh, FLinearColor(0.35f, 0.34f, 0.32f));
	UInstancedStaticMeshComponent* Marks = MakeISM(TEXT("LaneMarks"), CubeMesh, FLinearColor(0.8f, 0.65f, 0.1f));

	for (int32 X = 0; X < GridSize; ++X)
	{
		for (int32 Y = 0; Y < GridSize; ++Y)
		{
			const FVector C = TileCenter(X, Y);
			if (IsRoad(X, Y))
			{
				Roads->AddInstance(FTransform(FRotator::ZeroRotator, C + FVector(0, 0, 1.f), FVector(TileSize / ShapeSize, TileSize / ShapeSize, 0.04f)));
				const bool bAlongX = (Y % BlockEvery == 0) && (X % BlockEvery != 0);
				const bool bAlongY = (X % BlockEvery == 0) && (Y % BlockEvery != 0);
				if (bAlongX || bAlongY)
				{
					// Dashed centre line
					const FVector S = bAlongX ? FVector(1.6f, 0.12f, 0.01f) : FVector(0.12f, 1.6f, 0.01f);
					Marks->AddInstance(FTransform(FRotator::ZeroRotator, C + FVector(0, 0, 3.2f), S));
				}
			}
			else
			{
				// Raised lot / sidewalk slab under every building tile
				Walks->AddInstance(FTransform(FRotator::ZeroRotator, C + FVector(0, 0, 7.5f), FVector(TileSize / ShapeSize, TileSize / ShapeSize, 0.15f)));
			}
		}
	}

	// --- Buildings: taller toward the middle (a small downtown) ---
	const FLinearColor Palette[] = {
		FLinearColor(0.55f, 0.52f, 0.48f), // concrete
		FLinearColor(0.40f, 0.18f, 0.12f), // brick
		FLinearColor(0.70f, 0.66f, 0.58f), // limestone
		FLinearColor(0.20f, 0.25f, 0.30f), // dark glass tower
	};
	UInstancedStaticMeshComponent* Bldg[4];
	for (int32 i = 0; i < 4; ++i)
	{
		Bldg[i] = MakeISM(*FString::Printf(TEXT("Buildings%d"), i), CubeMesh, Palette[i]);
	}
	UInstancedStaticMeshComponent* Windows = MakeISM(TEXT("Windows"), CubeMesh, FLinearColor(0.05f, 0.07f, 0.09f), &WindowMID);
	UInstancedStaticMeshComponent* Roofs = MakeISM(TEXT("Roofs"), CubeMesh, FLinearColor(0.15f, 0.15f, 0.16f));

	const float Foot = TileSize * 0.76f;   // building footprint (cm)
	const float HalfFoot = Foot * 0.5f;
	const float WinW = Foot * 0.7f;
	const float WinH = FloorHeight * 0.38f;
	const float Center = GridSize * 0.5f;
	TArray<FVector> LightSpots;

	for (int32 X = 0; X < GridSize; ++X)
	{
		for (int32 Y = 0; Y < GridSize; ++Y)
		{
			if (IsRoad(X, Y) || Rng.FRand() < 0.15f) { continue; } // some empty lots

			const float D = FVector2D(X - Center, Y - Center).Size() / Center; // 0 centre .. ~1.4 corner
			const float Downtown = FMath::Clamp(1.f - D, 0.f, 1.f);
			int32 Floors = 1 + Rng.RandRange(0, 2) + FMath::RoundToInt(FMath::Pow(Downtown, 2.f) * Rng.RandRange(4, 26));
			Floors = FMath::Clamp(Floors, 1, 30);
			const float H = Floors * FloorHeight;

			const int32 Style = Floors >= 12 ? 3 : Rng.RandRange(0, 2);
			const FVector Base = TileCenter(X, Y) + FVector(0, 0, 15.f);
			Bldg[Style]->AddInstance(FTransform(FRotator::ZeroRotator, Base + FVector(0, 0, H * 0.5f), FVector(Foot / ShapeSize, Foot / ShapeSize, H / ShapeSize)));
			Roofs->AddInstance(FTransform(FRotator::ZeroRotator, Base + FVector(0, 0, H + 15.f), FVector(Foot * 0.6f / ShapeSize, Foot * 0.6f / ShapeSize, 0.3f)));

			// One window band per floor on all four faces
			for (int32 F = 0; F < Floors; ++F)
			{
				const float Z = Base.Z + F * FloorHeight + FloorHeight * 0.55f;
				const FVector2D Off[4] = { {HalfFoot + 2.f, 0.f}, {-HalfFoot - 2.f, 0.f}, {0.f, HalfFoot + 2.f}, {0.f, -HalfFoot - 2.f} };
				for (int32 Side = 0; Side < 4; ++Side)
				{
					const bool bXFace = Side < 2;
					const FVector Scale = bXFace ? FVector(0.04f, WinW / ShapeSize, WinH / ShapeSize) : FVector(WinW / ShapeSize, 0.04f, WinH / ShapeSize);
					Windows->AddInstance(FTransform(FRotator::ZeroRotator, FVector(Base.X + Off[Side].X, Base.Y + Off[Side].Y, Z), Scale));
				}
			}

			if (Floors >= 3)
			{
				// A warm light just off one facade, partway up, to fake lit windows at night.
				const float Sx = Rng.FRandRange(-1.f, 1.f) > 0 ? 1.f : -1.f;
				LightSpots.Add(FVector(Base.X + Sx * (HalfFoot + 60.f), Base.Y, Base.Z + FMath::Min(H * 0.5f, 1200.f)));
			}
		}
	}

	// Keep the lights for the tallest/most central spots up to the budget.
	LightSpots.Sort([](const FVector& A, const FVector& B) { return A.Z > B.Z; });
	for (int32 i = 0; i < LightSpots.Num() && i < MaxWindowLights; ++i)
	{
		WindowLights.Add(MakeLight(LightSpots[i], FLinearColor(1.f, 0.72f, 0.42f), 900.f));
	}

	// --- Street lights at every intersection ---
	UInstancedStaticMeshComponent* Poles = MakeISM(TEXT("LampPoles"), CylinderMesh, FLinearColor(0.08f, 0.08f, 0.09f));
	UInstancedStaticMeshComponent* Lamps = MakeISM(TEXT("LampHeads"), CubeMesh, FLinearColor(0.9f, 0.85f, 0.7f), &LampMID);
	for (int32 X = 0; X < GridSize; X += BlockEvery)
	{
		for (int32 Y = 0; Y < GridSize; Y += BlockEvery)
		{
			const FVector C = TileCenter(X, Y) + FVector(TileSize * 0.45f, TileSize * 0.45f, 0.f);
			Poles->AddInstance(FTransform(FRotator::ZeroRotator, C + FVector(0, 0, 300.f), FVector(0.12f, 0.12f, 6.f)));
			Lamps->AddInstance(FTransform(FRotator::ZeroRotator, C + FVector(0, 0, 605.f), FVector(0.5f, 0.3f, 0.12f)));
			StreetLights.Add(MakeLight(C + FVector(0, 0, 570.f), FLinearColor(1.f, 0.82f, 0.55f), 1800.f));
		}
	}

	SetNightAmount(0.f);
}

void ACBTownBuilder::SetNightAmount(float Night)
{
	Night = FMath::Clamp(Night, 0.f, 1.f);
	if (FMath::Abs(Night - LastNight) < 0.01f) { return; }
	LastNight = Night;

	// Lights switch on gradually around dusk.
	const float On = FMath::SmoothStep(0.25f, 0.6f, Night);
	for (UPointLightComponent* L : StreetLights) { if (L) { L->SetIntensity(On * 2000.f); } }
	for (UPointLightComponent* L : WindowLights) { if (L) { L->SetIntensity(On * 600.f); } }

	if (WindowMID)
	{
		// Dark glass by day, warm and bright at night (lit by the window lights).
		const FLinearColor Day(0.05f, 0.07f, 0.09f);
		const FLinearColor NightCol(1.f, 0.75f, 0.4f);
		WindowMID->SetVectorParameterValue(ColorParam, FLinearColor::LerpUsingHSV(Day, NightCol, On));
	}
	if (LampMID)
	{
		LampMID->SetVectorParameterValue(ColorParam, FMath::Lerp(FLinearColor(0.5f, 0.5f, 0.5f), FLinearColor(1.f, 0.9f, 0.6f), On));
	}
}
