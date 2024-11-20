import * as ts from 'typescript'
import { PathToNameAndType } from './visit.js'

export const addFileWithFactory = (
  node: ts.Node,
  checker: ts.TypeChecker,
  methods: PathToNameAndType = new Map(),
  expectedTypeName: string
) => {
  if (ts.isVariableDeclaration(node)) {
    const fileName = node.getSourceFile().fileName
    const variableTypeNode = node.type
    const variableName = node.name.getText()

    if (variableTypeNode && ts.isTypeReferenceNode(variableTypeNode)) {
      const typeNameNode = variableTypeNode.typeName || null

      let typeDeclarationPath: string | null = null

      // Check if the type name matches the expected type name
      if (
        ts.isIdentifier(typeNameNode) &&
        typeNameNode.text === expectedTypeName
      ) {
        const typeSymbol = checker.getSymbolAtLocation(typeNameNode)
        if (
          typeSymbol &&
          typeSymbol.declarations &&
          typeSymbol.declarations.length > 0
        ) {
          const declaration = typeSymbol.declarations[0]
          const sourceFile = declaration.getSourceFile()
          typeDeclarationPath = sourceFile.fileName // Get the path of the file where the type was declared
        }

        const variables = methods.get(fileName) || []
        variables.push({
          variable: variableName,
          type: typeNameNode.getText(),
          typePath: typeDeclarationPath,
        })
        methods.set(fileName, variables)
      }

      // Handle qualified type names if necessary
      else if (ts.isQualifiedName(typeNameNode)) {
        const lastName = typeNameNode.right.text
        if (lastName === expectedTypeName) {
          const typeSymbol = checker.getSymbolAtLocation(typeNameNode.right)
          if (
            typeSymbol &&
            typeSymbol.declarations &&
            typeSymbol.declarations.length > 0
          ) {
            const declaration = typeSymbol.declarations[0]
            const sourceFile = declaration.getSourceFile()
            typeDeclarationPath = sourceFile.fileName // Get the path of the file where the type was declared
          }

          const variables = methods.get(fileName) || []
          variables.push({
            variable: variableName,
            type: typeNameNode.getText(),
            typePath: typeDeclarationPath,
          })
          methods.set(fileName, variables)
        }
      }
    }
  }
}
