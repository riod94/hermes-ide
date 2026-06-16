import { store } from "./server/lib/store"; import { writeDockerCompose, restartContainers } from "./server/lib/docker"; writeDockerCompose(store); restartContainers().then(console.log);
