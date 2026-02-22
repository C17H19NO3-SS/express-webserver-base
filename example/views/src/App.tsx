import React from "react";

export const App = () => {
  return (
    <div className="container">
      <h1>🚀 EWB + React + Bun</h1>
      <p>This dynamic view is powered natively by Express & Bun.build.</p>

      <div className="card">
        <h3>Server Status</h3>
        <p>
          API Endpoint:{" "}
          <a href="/users" target="_blank">
            /users
          </a>
        </p>
        <p>
          Swagger Docs:{" "}
          <a href="/docs" target="_blank">
            /docs
          </a>
        </p>
      </div>
    </div>
  );
};
