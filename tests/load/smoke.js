import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10,
  duration: "1m",

  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
};

export default function () {
  const res = http.get("https://www.upc-connect.org/login", {
    timeout: "20s",
  });

  check(res, {
    "status is 200": (r) => r.status === 200,
  });

  if (res.status === 0) {
    console.error(
      `request failed: ${res.error} (code ${res.error_code})`
    );
  }

  sleep(1);
}