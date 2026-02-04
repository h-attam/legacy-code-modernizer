import React, { useState } from "react";
import axios from "axios";
import ComparisonView from "./ComparisonView";

function App() {
  const [legacyCode, setLegacyCode] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const response = await axios.post("/analyze", { legacyCode });
      setResult(response.data);
    } catch (error) {
      console.error("Error analyzing code:", error);
      alert("An error occurred during analysis.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gray-900 flex items-center justify-center">
            <span className="text-white font-bold text-lg">M</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            Modernizer
          </h1>
        </div>
        <div className="text-sm text-gray-500 font-medium">
          PHP to React Transpiler
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-12 flex flex-col gap-8">
        {/* Action Bar */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Analyze & Convert
            </h2>
            <p className="text-gray-500 mt-1">
              Transform your legacy PHP scripts into modern React components.
            </p>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !legacyCode}
            className="px-6 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
          >
            {loading ? "Processing..." : "Run Analysis"}
          </button>
        </div>

        {/* Main Content: Comparison */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6">
          <ComparisonView
            legacyCode={legacyCode}
            modernCode={result?.modernCode}
            onLegacyCodeChange={setLegacyCode}
            loading={loading}
          />
        </div>

        {/* Analysis Summary (Replaces AI Card) */}
        {result && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Complexity Score Panel */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Complexity
              </h3>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold text-gray-900">
                  {result.complexityScore}
                </span>
                <span className="text-gray-400 mb-1">/ 100</span>
              </div>
            </div>

            {/* Improvements Panel */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm col-span-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">
                Transformation Notes
              </h3>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                {result.explanation.map((item, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-400">
        &copy; {new Date().getFullYear()} Legacymodernizer. All rights reserved.
      </footer>
    </div>
  );
}

export default App;
