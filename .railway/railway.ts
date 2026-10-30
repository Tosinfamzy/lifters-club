import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "gymapp-api";
export default defineRailway(() => {
  const gymappApi = service("gymapp-api", {
    source: github("Tosinfamzy/lifters-club", { branch: "main", checkSuites: false }),
    build: { builder: "dockerfile", dockerfilePath: "apps/server/Dockerfile" },
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
