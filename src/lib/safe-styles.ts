const proto = CSSStyleSheet.prototype

const cssRulesDesc = Object.getOwnPropertyDescriptor(proto, 'cssRules')
if (cssRulesDesc?.get) {
  const original = cssRulesDesc.get
  Object.defineProperty(proto, 'cssRules', {
    get(this: CSSStyleSheet): CSSRuleList {
      try {
        return original.call(this)
      } catch {
        return [] as unknown as CSSRuleList
      }
    },
    configurable: true,
  })
}

const rulesDesc = Object.getOwnPropertyDescriptor(proto, 'rules')
if (rulesDesc?.get) {
  const original = rulesDesc.get
  Object.defineProperty(proto, 'rules', {
    get(this: CSSStyleSheet): CSSRuleList {
      try {
        return original.call(this)
      } catch {
        return [] as unknown as CSSRuleList
      }
    },
    configurable: true,
  })
}

export function getSafeCssRules(sheet: CSSStyleSheet): CSSRule[] {
  try {
    return Array.from(sheet.cssRules)
  } catch {
    return []
  }
}

export function getAllStylesAsText(): string {
  let cssText = ''
  for (const sheet of document.styleSheets) {
    const rules = getSafeCssRules(sheet)
    for (const rule of rules) {
      cssText += rule.cssText + '\n'
    }
  }
  return cssText
}
