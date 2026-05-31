import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { hashPassword } from "../src/lib/password";

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        const code = ch.charCodeAt(0);
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        } else if (code === 0x03) {
          process.stdout.write("\n");
          process.exit(1);
        } else if (code === 0x7f || code === 0x08) {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else if (code >= 0x20) {
          value += ch;
          process.stdout.write("*");
        }
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const rl = createInterface({ input, output });

  const username = (await rl.question("Brugernavn: ")).trim();
  if (!username) {
    console.error("Brugernavn må ikke være tomt.");
    rl.close();
    process.exit(1);
  }

  rl.close();

  const password = await promptHidden("Adgangskode: ");
  if (password.length < 8) {
    console.error("Adgangskoden skal være mindst 8 tegn.");
    process.exit(1);
  }
  const confirm = await promptHidden("Bekræft adgangskode: ");
  if (password !== confirm) {
    console.error("Adgangskoderne matcher ikke.");
    process.exit(1);
  }

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1);

  const passwordHash = await hashPassword(password);

  if (existing[0]) {
    await db
      .update(schema.users)
      .set({ passwordHash })
      .where(eq(schema.users.id, existing[0].id));
    console.log(`Adgangskode opdateret for "${username}".`);
  } else {
    await db.insert(schema.users).values({ username, passwordHash });
    console.log(`Bruger "${username}" oprettet.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
