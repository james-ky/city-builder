#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "CBDayNight.generated.h"

class UDirectionalLightComponent;
class USkyLightComponent;
class USkyAtmosphereComponent;
class UExponentialHeightFogComponent;
class UPostProcessComponent;
class ACBTownBuilder;

/** Sun, moon, sky atmosphere, sky light and fog, driven by a game clock. */
UCLASS()
class CITYBUILDER_API ACBDayNight : public AActor
{
	GENERATED_BODY()

public:
	ACBDayNight();
	virtual void Tick(float DeltaSeconds) override;

	/** Real seconds for one full game day at 1x speed. */
	UPROPERTY(EditAnywhere, Category = "Time") float SecondsPerDay = 240.f;
	UPROPERTY(EditAnywhere, Category = "Time") float SpeedMultiplier = 1.f;
	UPROPERTY(EditAnywhere, Category = "Time") bool bPaused = false;
	/** 0..24 */
	UPROPERTY(EditAnywhere, Category = "Time") float Hour = 15.f;
	UPROPERTY(EditAnywhere, Category = "Time") float SunYaw = 35.f;

	UPROPERTY(Transient) TObjectPtr<ACBTownBuilder> Town;

protected:
	virtual void BeginPlay() override;

	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> Root;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UDirectionalLightComponent> Sun;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UDirectionalLightComponent> Moon;
	UPROPERTY(VisibleAnywhere) TObjectPtr<USkyAtmosphereComponent> Atmosphere;
	UPROPERTY(VisibleAnywhere) TObjectPtr<USkyLightComponent> SkyLight;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UExponentialHeightFogComponent> Fog;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UPostProcessComponent> PostProcess;

private:
	void Apply();
};
