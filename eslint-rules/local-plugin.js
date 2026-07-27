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

const NATIVE_INTERACTIVE_ELEMENTS = new Set([
  'button',
  'input',
  'select',
  'summary',
  'textarea',
])

/**
 * Prevents a pointer handler from being attached to a static JSX element
 * without an equivalent keyboard event.
 *
 * Native controls already provide keyboard activation. A static element may
 * occasionally own a pointer interaction, but then it must explicitly expose
 * the same operation to Enter/Space through a key handler.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
const noPointerOnlyActions = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require pointer actions on static JSX elements to have keyboard parity.',
    },
    schema: [],
    messages: {
      pointerOnly:
        'A pointer action on a static element needs an equivalent keyboard handler or a native interactive element.',
    },
  },

  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier') return
        const element = node.name.name
        if (element[0] !== element[0]?.toLowerCase()) return

        const attributes = new Set(
          node.attributes
            .filter((attribute) => attribute.type === 'JSXAttribute')
            .map((attribute) =>
              attribute.name.type === 'JSXIdentifier'
                ? attribute.name.name
                : '',
            ),
        )
        if (!attributes.has('onClick')) return
        if (NATIVE_INTERACTIVE_ELEMENTS.has(element)) return
        if (element === 'a' && attributes.has('href')) return
        if (attributes.has('onKeyDown') || attributes.has('onKeyUp')) return

        context.report({ node, messageId: 'pointerOnly' })
      },
    }
  },
}

export default {
  rules: {
    'no-user-facing-literals': noUserFacingLiterals,
    'no-pointer-only-actions': noPointerOnlyActions,
  },
}
