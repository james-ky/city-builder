using UnrealBuildTool;

public class CityBuilderEditorTarget : TargetRules
{
	public CityBuilderEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("CityBuilder");
	}
}
