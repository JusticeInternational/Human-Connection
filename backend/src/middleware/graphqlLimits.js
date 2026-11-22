import { GraphQLError } from 'graphql'

export default function graphqlLimits({ maxDepth = 12, maxFields = 500 } = {}) {
  return (context) => ({
    OperationDefinition(operation) {
      let depth = 0
      let fields = 0
      let limitExceeded = false

      const visitSelectionSet = (selectionSet, parentDepth, fragmentsOnPath) => {
        if (!selectionSet || limitExceeded) return

        selectionSet.selections.forEach((selection) => {
          if (limitExceeded) return

          if (selection.kind === 'Field') {
            fields += 1
            depth = Math.max(depth, parentDepth + 1)
            if (fields > maxFields || depth > maxDepth) {
              limitExceeded = true
              return
            }
            visitSelectionSet(selection.selectionSet, parentDepth + 1, fragmentsOnPath)
          } else if (selection.kind === 'InlineFragment') {
            visitSelectionSet(selection.selectionSet, parentDepth, fragmentsOnPath)
          } else if (selection.kind === 'FragmentSpread') {
            const name = selection.name.value
            if (fragmentsOnPath.has(name)) return

            const fragment = context.getFragment(name)
            if (fragment) {
              fragmentsOnPath.add(name)
              visitSelectionSet(fragment.selectionSet, parentDepth, fragmentsOnPath)
              fragmentsOnPath.delete(name)
            }
          }
        })
      }

      visitSelectionSet(operation.selectionSet, 0, new Set())
      if (limitExceeded) {
        const message =
          fields > maxFields
            ? `GraphQL operation exceeds the maximum of ${maxFields} fields.`
            : `GraphQL operation exceeds the maximum depth of ${maxDepth}.`
        context.reportError(new GraphQLError(message, operation))
      }
    },
  })
}
