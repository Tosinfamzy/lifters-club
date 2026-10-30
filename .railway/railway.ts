import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "gymapp-api";
export default defineRailway(() => {
  const gymappApi = service("gymapp-api", {
    source: github("Tosinfamzy/lifters-club", { branch: "main", checkSuites: false }),
    // builder is upper-cased to match what the API returns. The importer emits
    // "dockerfile", which never compares equal, leaving a phantom change in
    // every plan and hiding real drift.
    // No buildTarget here on purpose. The old railway.toml set
    // buildTarget = "prod", but Railway does not support the field in Config
    // as Code or IaC and an apply does not persist it, so it was always inert.
    // The prod stage is selected because it is the last stage in
    // apps/server/Dockerfile — see the warning comment there.
    build: { builder: "DOCKERFILE", dockerfilePath: "apps/server/Dockerfile" },
    healthcheck: "/health",
    healthcheckTimeout: 300,
    preDeploy: "pnpm --filter @gymapp/db db:migrate",
    replicas: { "us-east4-eqdc4a": 1 },
    deploy: { preDeployTimeoutSeconds: 300, restartPolicyMaxRetries: 3 },
    domains: ["api.theliftersclub.com"],
  });

  return project("lifters-club", {
    variables: { managed: false },
    resources: [gymappApi],
  });
});
