// Synthetic local PostgreSQL concurrency check; no remote DB connection strings.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
const run = promisify(execFile);
const org = "20000000-0000-0000-0000-000000000099",
  user = "10000000-0000-0000-0000-000000000099",
  id = "50000000-0000-0000-0000-000000000099";
async function sql(command) {
  const { stdout } = await run(
    "docker",
    [
      "--host=unix:///var/run/docker.sock",
      "exec",
      "averomira-catalogue-test",
      "psql",
      "-U",
      "postgres",
      "-d",
      "averomira_test",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
      "-c",
      command,
    ],
    { maxBuffer: 1024 * 1024 },
  );
  return stdout;
}
const auth = `set request.jwt.claim.sub='${user}'; set role authenticated;`;
try {
  await sql(
    `insert into auth.users(id,email) values('${user}','concurrency@synthetic.invalid'); insert into public.organizations(id,name) values('${org}','Synthetic concurrency'); insert into public.organization_members(organization_id,user_id,role) values('${org}','${user}','owner')`,
  );
  await sql(
    `${auth} select public.prepare_catalogue_import('${org}','${id}','[{"sku":"ABC","name":"Synthetic","unit_price":0,"stock_quantity_provided":false}]','merge',repeat('a',64))`,
  );
  const command = `${auth} select public.commit_catalogue_import('${org}','${id}',false)`;
  const results = await Promise.all([sql(command), sql(command)]);
  const result = (output) =>
    JSON.parse(output.split("\n").find((line) => line.startsWith("{")));
  assert.deepEqual(result(results[0]), result(results[1]));
  assert.equal(
    (
      await sql(
        `select count(*) from public.products where organization_id='${org}'`,
      )
    ).trim(),
    "1",
  );
  assert.equal(
    (
      await sql(
        `select count(*) from public.activity_events where entity_id='${id}'`,
      )
    ).trim(),
    "1",
  );
  console.log(
    "PASS: concurrent duplicate commits serialize, return the same result and audit exactly once",
  );
} finally {
  await sql(
    `delete from public.activity_events where organization_id='${org}'; delete from public.organizations where id='${org}'; delete from auth.users where id='${user}'`,
  );
}
