#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "CBTownBuilder.generated.h"

class UStaticMesh;
class UMaterialInterface;
class UMaterialInstanceDynamic;
class UInstancedStaticMeshComponent;
class UPointLightComponent;

/**
 * Builds the placeholder test town entirely from code at BeginPlay:
 * ground, a road grid, box buildings of several heights, window panels,
 * street lights and night lights. Only engine basic shapes are used.
 */
UCLASS()
class CITYBUILDER_API ACBTownBuilder : public AActor
{
	GENERATED_BODY()

public:
	ACBTownBuilder();

	/** 0 = full day, 1 = full night. Called every frame by ACBDayNight. */
	void SetNightAmount(float Night);

	UPROPERTY(EditAnywhere, Category = "Town") int32 GridSize = 36;       // tiles per side
	UPROPERTY(EditAnywhere, Category = "Town") float TileSize = 400.f;    // cm (4 m)
	UPROPERTY(EditAnywhere, Category = "Town") int32 BlockEvery = 6;      // a road every N tiles
	UPROPERTY(EditAnywhere, Category = "Town") float FloorHeight = 350.f; // cm
	UPROPERTY(EditAnywhere, Category = "Town") int32 Seed = 1337;
	UPROPERTY(EditAnywhere, Category = "Town") int32 MaxWindowLights = 160;

protected:
	virtual void BeginPlay() override;

private:
	UPROPERTY() TObjectPtr<UStaticMesh> CubeMesh;
	UPROPERTY() TObjectPtr<UStaticMesh> CylinderMesh;
	UPROPERTY() TObjectPtr<UMaterialInterface> BaseMaterial;

	UPROPERTY() TObjectPtr<UMaterialInstanceDynamic> WindowMID;
	UPROPERTY() TObjectPtr<UMaterialInstanceDynamic> LampMID;
	UPROPERTY() TArray<TObjectPtr<UPointLightComponent>> StreetLights;
	UPROPERTY() TArray<TObjectPtr<UPointLightComponent>> WindowLights;

	float LastNight = -1.f;

	UInstancedStaticMeshComponent* MakeISM(const TCHAR* Name, UStaticMesh* Mesh, const FLinearColor& Color, UMaterialInstanceDynamic** OutMID = nullptr);
	UPointLightComponent* MakeLight(const FVector& Loc, const FLinearColor& Color, float Radius);
	bool IsRoad(int32 X, int32 Y) const;
	FVector TileCenter(int32 X, int32 Y) const;
};
