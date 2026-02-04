const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const port = 5001;

app.use(cors());
app.use(bodyParser.json());

app.post("/analyze", (req, res) => {
  const { legacyCode } = req.body;

  if (!legacyCode) {
    return res.status(400).json({ error: "Legacy code is required" });
  }

  let modernCode = "";
  let explanation = [];
  let complexityScore = 90;

  try {
    // --- HELPERS ---
    const convertStyle = (htmlString) => {
      // More robust style parser that handles {variables} inside value
      return htmlString.replace(/style="([^"]+)"/g, (match, styleContent) => {
        const styleProps = styleContent
          .split(";")
          .filter((s) => s.trim())
          .map((s) => {
            const parts = s.split(":");
            const key = parts[0];
            const value = parts.slice(1).join(":"); // Handle composed values
            if (!key || !value) return "";

            const camelKey = key
              .trim()
              .replace(/-([a-z])/g, (g) => g[1].toUpperCase());
            let cleanVal = value.trim().replace(/^{|}$/g, "");

            // If proper variable reference {var}
            if (value.trim().startsWith("{") && value.trim().endsWith("}")) {
              return `${camelKey}: ${value.trim().replace(/^{|}$/g, "")}`; // No quotes for vars
            }

            return `${camelKey}: '${cleanVal}'`;
          })
          .join(", ");
        return `style={{ ${styleProps} }}`;
      });
    };

    const cleanPhpSyntax = (str) => {
      str = str.replace(/count\(\$([a-zA-Z0-9_]+)\)/g, "$1.length");

      // $user['id'] -> user.id
      str = str.replace(/\$([a-zA-Z0-9_]+)\['([a-zA-Z0-9_]+)'\]/g, "$1.$2");
      str = str.replace(/\$([a-zA-Z0-9_]+)/g, "$1");

      // Concatenation fixes
      str = str.replace(/'\s*\.\s*([a-zA-Z0-9_.]+)\s*\.\s*'/g, "{$1}");
      str = str.replace(/'\s*\.\s*([a-zA-Z0-9_.]+)/g, "{$1}");
      str = str.replace(/([a-zA-Z0-9_.]+)\s*\.\s*'/g, "{$1}");
      // Fix explicit closing quote artifacts if regex missed
      str = str.replace(/\}\s*\.\s*'$/g, "}");

      str = str.replace(/class=/g, "className=");
      return convertStyle(str);
    };

    // --- 1. Variable Extraction (Global) ---
    let variables = [];
    let cleanCodeForVariables = legacyCode;

    const arrayVarRegex = /\$([a-zA-Z0-9_]+)\s*=\s*\[/g;
    let avMatch;
    while ((avMatch = arrayVarRegex.exec(legacyCode)) !== null) {
      let startIndex = avMatch.index;
      let openBrackets = 1;
      let currentIndex = startIndex + avMatch[0].length;
      let arrayContentEnd = -1;

      while (currentIndex < legacyCode.length && openBrackets > 0) {
        if (legacyCode[currentIndex] === "[") openBrackets++;
        if (legacyCode[currentIndex] === "]") openBrackets--;
        currentIndex++;
      }

      if (openBrackets === 0) {
        arrayContentEnd = currentIndex;
        let fullStmt = legacyCode.substring(startIndex, arrayContentEnd);
        let jsArray = fullStmt;

        if (fullStmt.includes("=>")) {
          jsArray = jsArray.replace(/=>/g, ":");
          jsArray = jsArray.replace(/\[\s*"([^"]+)"\s*:/g, '{ "$1":');
          jsArray = jsArray.replace(/:\s*([^,\]]+)\s*\]/g, ": $1 }");
          jsArray = jsArray.replace(/:\s*([^,\]]+)\s*,/g, ": $1,");
        }
        jsArray = jsArray.replace(/^\$([a-zA-Z0-9_]+)/, "const $1");
        jsArray = jsArray.replace(/\[\s*"([a-zA-Z0-9_]+)"\s*:/g, '{ "$1":');
        jsArray = jsArray.replace(/:\s*"([^"]+)"\s*\]/g, ': "$1" }');
        jsArray = jsArray.replace(/:\s*([0-9]+)\s*\]/g, ": $1 }");

        variables.push(jsArray + ";");
        cleanCodeForVariables = cleanCodeForVariables.replace(fullStmt, "");
      }
    }

    const strRegex = /\$([a-zA-Z0-9_]+)\s*=\s*"([^"]*)";/g;
    let sMatch;
    while ((sMatch = strRegex.exec(cleanCodeForVariables)) !== null) {
      variables.push(`const ${sMatch[1]} = "${sMatch[2]}";`);
      cleanCodeForVariables = cleanCodeForVariables.replace(sMatch[0], "");
    }

    // --- 2. Block Extraction (Stack Based) ---
    let renderBlocks = [];
    let workingCode = cleanCodeForVariables;
    let cursor = 0;
    const loopStartRegex =
      /foreach\s*\(\$([a-zA-Z0-9_]+)\s+as\s+\$([a-zA-Z0-9_]+)\)\s*\{/g;
    let loopMatch;

    while ((loopMatch = loopStartRegex.exec(workingCode)) !== null) {
      let preLoopContent = workingCode.substring(cursor, loopMatch.index);
      const echoMatches = preLoopContent.match(
        /echo\s*['"]([\s\S]*?)['"]\s*;/g,
      );
      if (echoMatches) {
        echoMatches.forEach((m) => {
          const c = m.match(/echo\s*['"]([\s\S]*?)['"]\s*;/)[1];
          renderBlocks.push(cleanPhpSyntax(c));
        });
      }

      let loopBodyStart = loopMatch.index + loopMatch[0].length;
      let braceCount = 1;
      let i = loopBodyStart;

      while (i < workingCode.length && braceCount > 0) {
        if (workingCode[i] === "{") braceCount++;
        if (workingCode[i] === "}") braceCount--;
        i++;
      }

      let loopBody = workingCode.substring(loopBodyStart, i - 1);
      let loopRenderItems = [];

      // --- LOGIC EXTRACTION (SIMPLE IF-ELSE) ---
      // Attempt to find simple conditional assignments inside loop
      // if ($user['status'] == 'active') { ... } else { ... }
      // We will try to extract 'var definitions' from these blocks to hoist them.
      let logicCode = [];

      // Regex for simple if-else assignment structure
      const ifElseRegex =
        /if\s*\(([^)]+)\)\s*\{([^}]+)\}\s*else\s*\{([^}]+)\}/g;
      let logicMatch;
      while ((logicMatch = ifElseRegex.exec(loopBody)) !== null) {
        const condition = logicMatch[1]
          .replace(/\$([a-zA-Z0-9_]+)\['([a-zA-Z0-9_]+)'\]/g, "$1.$2")
          .replace(/==/g, "===");
        const trueBlock = logicMatch[2];
        const falseBlock = logicMatch[3];

        // Find variable assignments
        const assignRegex = /\$([a-zA-Z0-9_]+)\s*=\s*['"]([^'"]+)['"];/g;
        let trueVars = {};
        let m;
        while ((m = assignRegex.exec(trueBlock)) !== null)
          trueVars[m[1]] = m[2];

        while ((m = assignRegex.exec(falseBlock)) !== null) {
          const varName = m[1];
          const falseVal = m[2];
          const trueVal = trueVars[varName];
          if (trueVal) {
            logicCode.push(
              `const ${varName} = ${condition} ? '${trueVal}' : '${falseVal}';`,
            );
          }
        }
      }

      const loopEchoMatches = loopBody.match(/echo\s*['"]([\s\S]*?)['"]\s*;/g);
      if (loopEchoMatches) {
        loopEchoMatches.forEach((m) => {
          const c = m.match(/echo\s*['"]([\s\S]*?)['"]\s*;/)[1];
          loopRenderItems.push(cleanPhpSyntax(c));
        });
      }

      const arrayName = loopMatch[1];
      const itemName = loopMatch[2];

      const logicBlock =
        logicCode.length > 0 ? logicCode.join("\n          ") + "\n" : "";

      const loopJsx = `{${arrayName}.map(${itemName} => {
          ${logicBlock}
          return (
            <React.Fragment key={${itemName}.id}>
              ${loopRenderItems.join("\n              ")}
            </React.Fragment>
          );
      })}`;
      renderBlocks.push(loopJsx);

      cursor = i;
      loopStartRegex.lastIndex = cursor;
    }

    const remainingContent = workingCode.substring(cursor);
    const postEchoMatches = remainingContent.match(
      /echo\s*['"]([\s\S]*?)['"]\s*;/g,
    );
    if (postEchoMatches) {
      postEchoMatches.forEach((m) => {
        const c = m.match(/echo\s*['"]([\s\S]*?)['"]\s*;/)[1];
        renderBlocks.push(cleanPhpSyntax(c));
      });
    }

    modernCode = `
import React from 'react';

const ModernComponent = () => {
  // Transpiled Variables
  ${variables.join("\n  ")}

  return (
    <div className="legacy-container">
      ${renderBlocks.join("\n      ")}
    </div>
  );
};

export default ModernComponent;
`;
    explanation = [
      "Improvements: Added conditional logic support (if-else -> ternary).",
      "Fixed valid React DOM structure in loops.",
      "Corrected style parser for variable interpolation.",
    ];
  } catch (err) {
    console.error(err);
    modernCode = "// Fatal Error\n" + err.message;
    explanation = ["System crash during transpilation."];
  }

  res.json({
    originalCode: legacyCode,
    modernCode: modernCode.trim(),
    explanation,
    complexityScore,
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
