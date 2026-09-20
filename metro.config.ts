import { getDefaultConfig } from "expo/metro-config";
import type { MetroConfig } from "metro-config";
import { withNativeWind } from "nativewind/metro";

const config = getDefaultConfig(__dirname) as unknown as MetroConfig;

export default withNativeWind(config, {
  input: "./src/global.css",
} as any) as MetroConfig;
