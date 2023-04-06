import { resolve } from "node:path";
import { formatToDateTime } from "@celeris/utils";
import { readPackageJSON } from "pkg-types";
import type { UserConfig } from "vite";
import { defineConfig, loadEnv, mergeConfig } from "vite";
import { configVitePlugins } from "../plugins";
import { configureProxy, updateEnvVariables } from "../utils";

interface ApplicationViteConfigOptions {
  overrides?: UserConfig;
  options?: {};
}

export async function createApplicationViteConfig(applicationViteConfigOptions: ApplicationViteConfigOptions = {}) {
  const { overrides = {} } = applicationViteConfigOptions;
  return defineConfig(async ({ command, mode }) => {
    const root = process.cwd();
    const isProductionBuild = command === "build";
    const env: Recordable<string> = loadEnv(mode, root);
    const defineData = await createDefineData(root);
    const viteEnv = updateEnvVariables(env);
    const {
      VITE_PORT,
      VITE_PROXY,
      VITE_USE_HTTPS,
      VITE_PUBLIC_PATH,
      VITE_DROP_CONSOLE,
    } = viteEnv;
    const plugins = configVitePlugins(root, viteEnv, isProductionBuild);
    const pathResolve = (pathname: string) => resolve(root, ".", pathname);

    const applicationConfig: UserConfig = {
      root,
      base: VITE_PUBLIC_PATH,

      resolve: {
        alias: {
          "~/": `${pathResolve("src")}/`,
        },
      },
      server: {
        // Listening on all local IPs
        host: VITE_USE_HTTPS,
        port: VITE_PORT,
        open: true,
        https: false,
        proxy: !VITE_USE_HTTPS ? configureProxy(VITE_PROXY) : {},
      },
      esbuild: {
        pure: VITE_DROP_CONSOLE ? ["console.log", "debugger"] : [],
      },
      define: defineData,
      build: {
        target: "es2015",
        cssTarget: "chrome80",
        rollupOptions: {
          output: {
            manualChunks: {
              vue: ["vue", "pinia", "vue-router"],
            },
          },
        },
      },
      css: {
        preprocessorOptions: {
        },
      },
      plugins,
    };
    return mergeConfig(applicationConfig, overrides);
  });
}

async function createDefineData(root: string) {
  try {
    const pkgJson = await readPackageJSON(root);
    const { dependencies, devDependencies, name, version } = pkgJson;

    const __APP_INFO__ = {
      pkg: { dependencies, devDependencies, name, version },
      lastBuildTime: formatToDateTime(new Date()),
    };
    return {
      __APP_INFO__: JSON.stringify(__APP_INFO__),
    };
  } catch (error) {
    return {};
  }
}
