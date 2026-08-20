import assert from "node:assert/strict";
import Papa from "papaparse";

import {
  createTrustedMasterSyncHandler,
  MAX_CSV_BYTES,
  TRUSTED_MASTER_SOURCE_DEFINITIONS,
} from "../supabase/functions/sync-review-master-data/index.ts";

const ALLOWED_ORIGIN = "https://admin.example.test";

function csv(rows) {
  return Papa.unparse(rows, { newline: "\n" });
}

const sourceCsv = {
  questions: csv([{
    question_id: "Q-1",
    question_type: "MP",
    question_ind: "Pilih jawaban.",
    question_en: "Choose an answer.",
    question_code: "",
    content_blocks_ind: "",
    content_blocks_en: "",
    input_description_ind: "",
    input_description_en: "",
    output_description_ind: "",
    output_description_en: "",
    sample_inputs: "",
    sample_outputs: "",
    test_cases_json: "",
    active: "TRUE",
  }]),
  answers: csv([{
    answer_id: "A-1",
    question_id: "Q-1",
    answer_role: "mp_option",
    active: "TRUE",
  }]),
  questionMisconceptions: csv([{
    question_id: "Q-1",
    misconception_id: "M-1",
    source: "master",
    evidence_level: "E",
    rationale_ind: "Alasan",
    source_question_id: "",
    active: "TRUE",
  }]),
  answerMisconceptions: csv([{
    answer_id: "A-1",
    misconception_id: "M-1",
    reason_ind: "Alasan",
    reason_en: "Reason",
    active: "TRUE",
  }]),
  misconceptions: csv([{
    misconception_id: "M-1",
    active: "TRUE",
  }]),
};

function testHarness(scenario = {}) {
  const environmentReads = [];
  const clientKeys = [];
  const sourceByUrl = new Map();
  const environment = {
    ADMIN_APP_ORIGINS: ALLOWED_ORIGIN,
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_ANON_KEY: "anon-key",
    ...scenario.environment,
  };
  for (const definition of TRUSTED_MASTER_SOURCE_DEFINITIONS) {
    const url = `https://docs.google.com/${definition.name}`;
    environment[definition.environmentName] = url;
    sourceByUrl.set(url, sourceCsv[definition.name]);
  }

  const fetchCalls = [];
  const fetchStub = scenario.fetch ?? ((input) => {
    const url = String(input);
    fetchCalls.push(url);
    return new Response(sourceByUrl.get(url), {
      status: 200,
      headers: { "content-type": "text/csv; charset=utf-8" },
    });
  });
  const createClientStub = scenario.createClient ?? ((_, key) => {
    clientKeys.push(key);
    return {
      auth: {
        getUser: () =>
          scenario.validToken === false
            ? { data: { user: null }, error: { message: "invalid" } }
            : { data: { user: { id: "user-1" } }, error: null },
      },
      from: () => {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: () => ({
            data: scenario.profileActive === false ? null : { active: true },
            error: scenario.profileError ? { message: "profile failed" } : null,
          }),
        };
        return query;
      },
      rpc: (name) => {
        if (name === "current_user_is_admin") {
          return {
            data: scenario.admin === false ? false : true,
            error: scenario.adminError ? { message: "admin failed" } : null,
          };
        }
        throw new Error("Privileged RPC must not be called in handler tests");
      },
    };
  });

  const handler = createTrustedMasterSyncHandler({
    envGet: (name) => {
      environmentReads.push(name);
      return environment[name];
    },
    fetch: fetchStub,
    createClient: createClientStub,
  });
  return { handler, environmentReads, clientKeys, fetchCalls, sourceByUrl };
}

function request(method, options = {}) {
  const headers = new Headers(options.headers);
  if (options.origin !== null) {
    headers.set("origin", options.origin ?? ALLOWED_ORIGIN);
  }
  if (options.auth !== false) headers.set("authorization", "Bearer user-token");
  if (options.body !== undefined && options.contentType !== null) {
    headers.set("content-type", options.contentType ?? "application/json");
  }
  return new Request("https://function.example.test/sync-review-master-data", {
    method,
    headers,
    ...(options.body === undefined ? {} : { body: options.body }),
  });
}

async function responseJson(response) {
  return JSON.parse(await response.text());
}

{
  const { handler, clientKeys, fetchCalls } = testHarness();
  const response = await handler(request("OPTIONS", { auth: false }));
  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    ALLOWED_ORIGIN,
  );
  assert.equal(response.headers.get("vary"), "Origin");
  assert.equal(
    response.headers.get("access-control-allow-methods"),
    "POST, OPTIONS",
  );
  assert.equal(clientKeys.length, 0);
  assert.equal(fetchCalls.length, 0);
}

{
  const { handler } = testHarness();
  const response = await handler(request("OPTIONS", {
    auth: false,
    origin: "https://attacker.example",
  }));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
}

{
  const { handler } = testHarness();
  const response = await handler(request("POST", { auth: false }));
  assert.equal(response.status, 401);
}

{
  const { handler } = testHarness({ validToken: false });
  const response = await handler(request("POST"));
  assert.equal(response.status, 401);
}

{
  const { handler } = testHarness({ profileActive: false });
  const response = await handler(request("POST"));
  assert.equal(response.status, 403);
}

{
  const { handler } = testHarness({ admin: false });
  const response = await handler(request("POST"));
  assert.equal(response.status, 403);
}

{
  const { handler, environmentReads, clientKeys } = testHarness();
  const response = await handler(request("POST", {
    body: JSON.stringify({ mode: "preview" }),
  }));
  assert.equal(response.status, 200, await response.text());
  assert.equal(environmentReads.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  assert.deepEqual(clientKeys, ["anon-key"]);
}

{
  const { handler } = testHarness({
    fetch: (input) => {
      const url = new URL(String(input));
      const sourceName = url.pathname.slice(1);
      return url.hostname === "docs.google.com"
        ? new Response(null, {
          status: 307,
          headers: {
            location:
              `https://doc-10-08-sheets.googleusercontent.com/${sourceName}`,
          },
        })
        : new Response(sourceCsv[sourceName], {
          status: 200,
          headers: { "content-type": "text/csv; charset=utf-8" },
        });
    },
  });
  const response = await handler(request("POST"));
  assert.equal(response.status, 200, await response.text());
}

{
  const { handler, environmentReads, clientKeys } = testHarness();
  const response = await handler(request("POST", {
    body: JSON.stringify({ mode: "sync" }),
  }));
  assert.equal(response.status, 503);
  assert.equal((await responseJson(response)).error.code, "SYNC_DISABLED");
  assert.equal(environmentReads.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  assert.deepEqual(clientKeys, ["anon-key"]);
}

{
  const { handler } = testHarness();
  const response = await handler(request("POST", {
    body: new Uint8Array(1_025),
  }));
  assert.equal(response.status, 413);
}

{
  const { handler } = testHarness();
  const response = await handler(request("POST", {
    body: JSON.stringify({ mode: "preview" }),
    contentType: "text/plain",
  }));
  assert.equal(response.status, 415);
}

{
  const oversized = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_CSV_BYTES));
      controller.enqueue(new Uint8Array(1));
      controller.close();
    },
  });
  const { handler } = testHarness({
    fetch: (input) =>
      String(input).endsWith("/questions")
        ? new Response(oversized, {
          status: 200,
          headers: { "content-type": "text/csv" },
        })
        : new Response(sourceCsv[String(input).split("/").at(-1)], {
          status: 200,
          headers: { "content-type": "text/csv" },
        }),
  });
  const response = await handler(request("POST"));
  assert.equal(response.status, 502);
  assert.equal(
    (await responseJson(response)).error.code,
    "MASTER_SOURCE_TOO_LARGE",
  );
}

{
  const { handler } = testHarness({
    fetch: (input) =>
      String(input).endsWith("/questions")
        ? new Response('"unterminated', {
          status: 200,
          headers: { "content-type": "text/csv" },
        })
        : new Response(sourceCsv[String(input).split("/").at(-1)], {
          status: 200,
          headers: { "content-type": "text/csv" },
        }),
  });
  const response = await handler(request("POST"));
  assert.equal(response.status, 422);
}

{
  const { handler } = testHarness({
    fetch: () =>
      new Response(null, {
        status: 307,
        headers: {
          location: "https://googleusercontent.com.attacker.example/data",
        },
      }),
  });
  const response = await handler(request("POST"));
  assert.equal(response.status, 502);
  assert.equal(
    (await responseJson(response)).error.code,
    "MASTER_SOURCE_REDIRECT_REJECTED",
  );
}

{
  const { handler } = testHarness({
    fetch: () =>
      new Response(null, {
        status: 307,
        headers: { location: "https://docs.google.com/again" },
      }),
  });
  const response = await handler(request("POST"));
  assert.equal(response.status, 502);
  assert.equal(
    (await responseJson(response)).error.code,
    "MASTER_SOURCE_REDIRECT_LIMIT",
  );
}

{
  const { handler } = testHarness({
    fetch: () =>
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  });
  const response = await handler(request("POST"));
  assert.equal(response.status, 502);
  assert.equal(
    (await responseJson(response)).error.code,
    "MASTER_SOURCE_CONTENT_TYPE_INVALID",
  );
}

{
  const { handler } = testHarness({
    createClient: () => {
      throw new Error("INTERNAL SECRET MUST NOT LEAK");
    },
  });
  const response = await handler(request("POST"));
  const body = await response.text();
  assert.equal(response.status, 500);
  assert.equal(body.includes("INTERNAL SECRET"), false);
  assert.equal(JSON.parse(body).error.code, "INTERNAL_ERROR");
}

console.log("trusted master sync handler checks passed");
