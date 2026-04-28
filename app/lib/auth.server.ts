import { betterAuth } from "better-auth"
import { D1Dialect } from 'kysely-d1';

export function getAuth({
    database,
    baseURL,
}: {
    database: D1Database
    baseURL?: string
}) {
    return betterAuth({
        baseURL,
        database: {
           type: "sqlite",
           dialect: new D1Dialect({ database }), 
        },
        emailAndPassword: {
            enabled: true
        }
    })
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
