import React from 'react';

const ComparisonView = ({ legacyCode, modernCode, onLegacyCodeChange, loading }) => {
  return (
    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[500px]">
      {/* Left Panel: Input/Legacy */}
      <div className="flex flex-col">
        <label className="mb-2 font-semibold text-gray-700">Legacy Code (PHP)</label>
        {onLegacyCodeChange ? (
          <textarea
            className="flex-1 w-full p-4 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-none bg-white"
            placeholder="<?php echo 'Hello World'; ?>"
            value={legacyCode}
            onChange={(e) => onLegacyCodeChange(e.target.value)}
          />
        ) : (
          <pre className="flex-1 bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto font-mono text-sm border border-gray-700">
             <code>{legacyCode}</code>
          </pre>
        )}
      </div>

      {/* Right Panel: Output/Modern */}
      <div className="flex flex-col">
        <label className="mb-2 font-semibold text-green-700">Modernized Code (React/Node.js)</label>
        <div className="flex-1 w-full p-4 border border-gray-300 rounded-lg shadow-inner bg-gray-50 font-mono text-sm overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-500 animate-pulse">
                  Generating modern code...
              </div>
            ) : (
              <pre><code>{modernCode || '// Output will appear here'}</code></pre>
            )}
        </div>
      </div>
    </div>
  );
};

export default ComparisonView;
