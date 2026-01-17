interface HelloResponse {
    message: string;
}

import { defineAction } from "../../titan/runtime";

export const hello = defineAction((req): HelloResponse => {
    return {
        message: `Hello from Titan ${req.body.name || "World"}`,
    };
});
