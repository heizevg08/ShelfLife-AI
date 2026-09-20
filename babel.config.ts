type BabelApi = {
  cache: (value: boolean) => void;
};

type BabelConfig = {
  presets: Array<string | [string, { jsxImportSource?: string }]>;
};

export default function babelConfig(api: BabelApi): BabelConfig {
  api.cache(true);

  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
}
