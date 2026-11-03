#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "CBCameraPawn.generated.h"

class USpringArmComponent;
class UCameraComponent;

/** City-builder camera: WASD / arrow keys / screen-edge pan, wheel zoom, Q/E rotate. */
UCLASS()
class CITYBUILDER_API ACBCameraPawn : public APawn
{
	GENERATED_BODY()

public:
	ACBCameraPawn();
	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

	UPROPERTY(EditAnywhere, Category = "Camera") float PanSpeed = 2500.f;      // cm/s at the default zoom
	UPROPERTY(EditAnywhere, Category = "Camera") float EdgeMargin = 12.f;      // pixels
	UPROPERTY(EditAnywhere, Category = "Camera") float RotateSpeed = 90.f;     // deg/s
	UPROPERTY(EditAnywhere, Category = "Camera") float MinZoom = 1500.f;
	UPROPERTY(EditAnywhere, Category = "Camera") float MaxZoom = 12000.f;
	UPROPERTY(EditAnywhere, Category = "Camera") float ZoomStep = 0.12f;       // fraction per wheel notch
	UPROPERTY(EditAnywhere, Category = "Camera") float MapHalfExtent = 7000.f; // clamp pan to the map

protected:
	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> Root;
	UPROPERTY(VisibleAnywhere) TObjectPtr<USpringArmComponent> Arm;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UCameraComponent> Camera;

private:
	float TargetZoom = 5000.f;
	float TargetPitch = -55.f;

	void ZoomIn();
	void ZoomOut();
	void SetSpeed1();
	void SetSpeed2();
	void SetSpeed3();
	void TogglePause();
	void SetGameSpeed(float Mult);
};
