interface HelloResponse {
    message: string;
}

export const ts_hello = (req: TitanRequest): HelloResponse => {
    return {
        message: `Hello from Titan ${req.body.name || "World"}`,
    };
}
