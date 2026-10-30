export function isInstalled(standalone: boolean, iosStandalone: boolean, installedEvent: boolean) {
  return standalone || iosStandalone || installedEvent;
}
export function canOfferInstall(installed: boolean, hasPrompt: boolean) {
  return !installed && hasPrompt;
}