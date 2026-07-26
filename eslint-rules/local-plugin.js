/**
 * Repository-local ESLint rules.
 *
 * These exist because the rules they enforce are specific to this codebase and
 * are not worth a published package.
 */

/**
 * The JSX attributes whose value a person reads or hears. Anything here is
 * copy, and copy belongs in the localisation catalog.
 */
const DEFAULT_USER_FACING_ATTRIBUTES = [
  'alt',
  'aria-description',
  'aria-label',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
  'download',
  'label',
  'placeholder',
  'title',
]

/** True for text that only spaces out the markup. */
function isInsignificant(text) {
  return text.trim() === ''
}

/**
 * Forbids user-facing text written as a literal inside a component.
 *
 * A string typed into JSX cannot be translated, cannot be reviewed as copy,
 * and cannot be found again when the wording has to change. The rule covers
 * element text, string children in expression containers, and the attributes
 * a screen reader announces — which is where hard-coded copy usually survives
 * a review, because nobody sees it on screen.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
const noUserFacingLiterals = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require user-facing text to come from the localisation catalog.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          attributes: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      text: 'User-facing text must come from the localisation catalog, not a literal in a component.',
      attribute:
        'The "{{name}}" value is read to a person, so it must come from the localisation catalog, not a literal in a component.',
    },
  },

  create(context) {
    const options = context.options[0] ?? {}
    const attributes = new Set(
      options.attributes ?? DEFAULT_USER_FACING_ATTRIBUTES,
    )

    /** Reports a node that holds literal copy, ignoring pure whitespace. */
    const reportLiteral = (node, messageId, data) => {
      if (node.type === 'Literal') {
        if (typeof node.value !== 'string' || isInsignificant(node.value)) {
          return
        }
        context.report({ node, messageId, data })
        return
      }
      if (node.type === 'TemplateLiteral') {
        const literal = node.quasis
          .map((quasi) => quasi.value.cooked ?? '')
          .join('')
        if (isInsignificant(literal)) return
        context.report({ node, messageId, data })
      }
    }

    return {
      JSXText(node) {
        if (isInsignificant(node.value)) return
        context.report({ node, messageId: 'text' })
      },

      JSXExpressionContainer(node) {
        if (node.parent?.type !== 'JSXElement') return
        reportLiteral(node.expression, 'text', undefined)
      },

      JSXAttribute(node) {
        const name =
          node.name.type === 'JSXNamespacedName'
            ? `${node.name.namespace.name}:${node.name.name.name}`
            : node.name.name
        if (!attributes.has(name)) return
        if (!node.value) return
        const value =
          node.value.type === 'JSXExpressionContainer'
            ? node.value.expression
            : node.value
        reportLiteral(value, 'attribute', { name })
      },
    }
  },
}

export default {
  rules: {
    'no-user-facing-literals': noUserFacingLiterals,
  },
}
