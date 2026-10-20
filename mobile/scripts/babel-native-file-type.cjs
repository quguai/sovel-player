// file-type's portable entry also exports a Node-only file helper. Its ignored,
// variable import is not supported by Hermes. Fail explicitly if that helper is
// ever used; our file access is provided by RangeTokenizer / expo-file-system.
module.exports = ({ types: t }) => ({
  visitor: {
    FunctionDeclaration(path, state) {
      if (
        state.filename?.endsWith("/file-type/source/index.js") &&
        path.node.id?.name === "importAtRuntime"
      ) {
        path
          .get("body")
          .replaceWith(
            t.blockStatement([
              t.throwStatement(
                t.newExpression(t.identifier("Error"), [
                  t.stringLiteral(
                    "Node file access is unavailable. Use the native ranged reader.",
                  ),
                ]),
              ),
            ]),
          );
      }
    },
  },
});
