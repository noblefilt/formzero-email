import { betterAuth } from "better-auth"
import { D1Dialect } from 'kysely-d1';

export function getAuth({
    database,
    baseURL,
    env,
}: {
    database: D1Database
    baseURL?: string
    env?: unknown
}) {
    const secret = getAuthSecret(env)

    return betterAuth({
        baseURL,
        ...(secret ? { secret } : {}),
        database: {
           type: "sqlite",
           dialect: new D1Dialect({ database }), 
        },
        emailAndPassword: {
            enabled: true
        }
    })
}

function getAuthSecret(env: unknown) {
    if (!env || typeof env !== "object") {
        return undefined
    }

    const value = (env as { BETTER_AUTH_SECRET?: unknown }).BETTER_AUTH_SECRET
    return typeof value === "string" && value.trim() ? value : undefined
}

export async function getUserCount({ database }: { database: D1Database }): Promise<number> {
    const result = await database
        .prepare("SELECT COUNT(*) as count FROM user")
        .first<{ count: number }>();

    if (!result) {
        throw new Error("Failed to retrieve user count");
    }

    return result.count;
}
