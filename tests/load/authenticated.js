import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "https://www.upc-connect.org";
const LOAD_TEST_SECRET = __ENV.LOAD_TEST_SECRET;
const TEST_EMAIL = __ENV.TEST_EMAIL;
const TEST_PASSWORD = __ENV.TEST_PASSWORD;

export const options = {
  vus: 1,
  iterations: 1,

  thresholds: {
    checks: ["rate==1"],
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],

    "http_req_duration{page:login}": ["p(95)<1500"],
    "http_req_duration{page:dashboard}": ["p(95)<1500"],
    "http_req_duration{page:members}": ["p(95)<1500"],
    "http_req_duration{page:attendance}": ["p(95)<1500"],
    "http_req_duration{page:reports}": ["p(95)<1500"],
  },
};

export default function () {
  const loginRes = http.post(
    `${BASE_URL}/api/load-test/login`,
    JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "x-load-test-secret": LOAD_TEST_SECRET,
      },
      redirects: 0,
      tags: {
        page: "login",
      },
    }
  );

  console.log(`login status=${loginRes.status}`);
  console.log(`login location=${loginRes.headers.Location || ""}`);
  console.log(`login body=${loginRes.body}`);

  const loginOk = check(loginRes, {
    "login: expected status and no login redirect": (r) =>
      r.status === 200 &&
      !String(r.headers.Location || "").includes("/login"),
  });

  if (!loginOk) {
    return;
  }

  const dashboardRes = http.get(`${BASE_URL}/portal`, {
    redirects: 0,
    tags: {
      page: "dashboard",
    },
  });

  console.log(
    `dashboard status=${dashboardRes.status}, location=${
      dashboardRes.headers.Location || ""
    }`
  );

  check(dashboardRes, {
    "dashboard: authenticated": (r) =>
      (r.status === 200 ||
        [301, 302, 303, 307, 308].includes(r.status)) &&
      !String(r.headers.Location || "").includes("/login"),
  });

  const membersRes = http.get(`${BASE_URL}/portal/members`, {
    redirects: 0,
    tags: {
      page: "members",
    },
  });

  console.log(
    `members status=${membersRes.status}, location=${
      membersRes.headers.Location || ""
    }`
  );

  check(membersRes, {
    "members: authenticated": (r) =>
      r.status === 200 &&
      !String(r.headers.Location || "").includes("/login"),
  });
}
