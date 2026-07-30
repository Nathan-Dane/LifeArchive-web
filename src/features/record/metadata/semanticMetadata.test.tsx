import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StructuredTags } from '../../../core/client'
import { I18nProvider } from '../../../i18n'
import { RecordSemanticIcon } from '../events'
import { RecordTagPicker } from './RecordTags'
import { SemanticIconPicker } from './SemanticIconPicker'
import {
  EVENT_DEFAULT_ICON_ID,
  MATERIAL_ICON_BY_SEMANTIC_ID,
  MATERIAL_UI_GLYPHS,
  ORDERED_SEMANTIC_ICON_IDS,
  PREDEFINED_TAG_IDS,
  SEMANTIC_ICON_CATALOG_VERSION,
  SEMANTIC_ICON_CATEGORIES,
  SPAN_DEFAULT_ICON_ID,
  addTag,
  chooseDisplayTag,
  materialIconFor,
  removeTag,
} from './semanticCatalog'

function localised(node: React.ReactNode) {
  return render(<I18nProvider locale="en">{node}</I18nProvider>)
}

function rect(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the negotiated semantic catalogue adapter', () => {
  it('mirrors catalogue v1 order and defaults with one Material glyph per ID', () => {
    expect(SEMANTIC_ICON_CATALOG_VERSION).toBe(1)
    expect(EVENT_DEFAULT_ICON_ID).toBe('life-event')
    expect(SPAN_DEFAULT_ICON_ID).toBe('span')
    expect(SEMANTIC_ICON_CATEGORIES).toHaveLength(12)
    expect(ORDERED_SEMANTIC_ICON_IDS).toHaveLength(157)
    expect(new Set(ORDERED_SEMANTIC_ICON_IDS)).toHaveLength(157)
    expect(Object.keys(MATERIAL_ICON_BY_SEMANTIC_ID)).toEqual(
      ORDERED_SEMANTIC_ICON_IDS,
    )
    expect(materialIconFor('life-event')).toBe('flag')
    expect(materialIconFor('span')).toBe('calendar_month')
    expect(materialIconFor('loss')).toBe('candle')
  })

  it('renders known Material glyphs and preserves an unknown ID exactly', () => {
    const { rerender } = localised(<RecordSemanticIcon id="birthday" />)
    expect(screen.getByRole('img', { name: 'Birthday' })).toHaveAttribute(
      'data-material-icon',
      'cake',
    )

    rerender(
      <I18nProvider locale="en">
        <RecordSemanticIcon id="future.icon-🌿" />
      </I18nProvider>,
    )
    const unknown = screen.getByRole('img', {
      name: 'Unrecognised icon future.icon-🌿',
    })
    expect(unknown).toHaveAttribute('data-semantic-icon-id', 'future.icon-🌿')
    expect(unknown).toHaveAttribute('data-material-icon', 'question_mark')
    expect(materialIconFor('future.icon-🌿')).toBeNull()
  })

  it('exposes all 157 choices as named keyboard options in runtime order', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    localised(<SemanticIconPicker value="life-event" onChange={onChange} />)

    await user.click(
      screen.getByRole('button', {
        name: 'Icon: Major event. Choose icon',
      }),
    )
    const allIcons = screen.getByRole('tab', { name: /All icons157/ })
    expect(allIcons).toHaveAttribute('aria-selected', 'true')
    expect(
      allIcons.querySelector('[data-material-icon="grid_view"]'),
    ).toBeInTheDocument()
    expect(MATERIAL_UI_GLYPHS.all).toBe('grid_view')
    expect(screen.getByRole('separator')).toBeVisible()
    expect(screen.getAllByRole('region')).toHaveLength(12)
    const choices = screen.getAllByRole('option')
    expect(choices).toHaveLength(157)
    expect(choices[0]).toHaveAccessibleName('Major event')
    expect(choices.at(-1)).toHaveAccessibleName('Other')
    expect(
      choices[0]?.querySelector('.semantic-icon-picker__selected'),
    ).not.toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Use icon' })).toHaveFocus()
    await user.click(choices[0]!)
    await user.click(screen.getByRole('tab', { name: /Life & Change12/ }))
    await waitFor(() => expect(screen.getAllByRole('listbox')).toHaveLength(1))
    expect(
      document.querySelector('.semantic-icon-picker__name'),
    ).toHaveTextContent('Major event')
    await user.click(screen.getByRole('button', { name: 'Use icon' }))
    expect(onChange).toHaveBeenCalledWith('life-event')
  })
})

describe('ordered tags and their one display tag', () => {
  it('adds, removes, and chooses display without reordering peer tags', () => {
    const empty: StructuredTags = { ordered: [], display: null }
    const personal = addTag(empty, 'personal')
    expect(personal).toEqual({
      ordered: ['personal'],
      display: 'personal',
    })
    const creative = addTag(personal, 'creative')
    expect(creative).toEqual({
      ordered: ['personal', 'creative'],
      display: 'personal',
    })
    expect(chooseDisplayTag(creative, 'creative')).toEqual({
      ordered: ['personal', 'creative'],
      display: 'creative',
    })
    expect(
      removeTag(chooseDisplayTag(creative, 'creative'), 'creative'),
    ).toEqual({ ordered: ['personal'], display: 'personal' })
    expect(removeTag(personal, 'personal')).toEqual({
      ordered: [],
      display: null,
    })
  })

  it('keeps unknown tags exact and offers every built-in in catalogue order', async () => {
    const user = userEvent.setup()
    expect(PREDEFINED_TAG_IDS).toEqual([
      'personal',
      'family',
      'friends',
      'work',
      'education',
      'travel',
      'home',
      'health',
      'creative',
      'achievement',
    ])
    const onChange = vi.fn()
    localised(
      <RecordTagPicker
        tags={{ ordered: ['future.tag-🌿'], display: 'future.tag-🌿' }}
        onChange={onChange}
      />,
    )
    expect(screen.getAllByText('future.tag-🌿')).toHaveLength(1)
    expect(
      screen.getByLabelText('Unrecognised tag future.tag-🌿, main tag'),
    ).toHaveAttribute('data-semantic-tag-id', 'future.tag-🌿')
    await user.click(screen.getByRole('button', { name: 'Manage tags' }))
    expect(screen.getAllByText('future.tag-🌿')).toHaveLength(2)
    expect(screen.getAllByRole('menuitemcheckbox')).toHaveLength(11)
  })

  it('supports keyboard add and explicit Main selection without list reordering', async () => {
    const user = userEvent.setup()

    function Harness() {
      const [tags, setTags] = useState<StructuredTags>({
        ordered: [],
        display: null,
      })
      return <RecordTagPicker tags={tags} onChange={setTags} />
    }

    localised(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Manage tags' }))
    const menu = screen.getByRole('menu', { name: 'Choose tags' })
    expect(menu).not.toHaveAttribute('aria-modal')
    expect(menu.querySelectorAll('.record-tag')).toHaveLength(10)
    const personal = screen.getByRole('menuitemcheckbox', {
      name: 'Personal',
    })
    const family = screen.getByRole('menuitemcheckbox', { name: 'Family' })
    expect(personal).not.toHaveFocus()
    expect(menu.querySelector('.record-tag-picker__list')).toHaveAttribute(
      'data-keyboard-navigation',
      'false',
    )
    expect(
      screen.queryByRole('menuitem', { name: 'Make Personal the main tag' }),
    ).toBeNull()
    expect(
      screen.queryByRole('menuitem', { name: 'Make Family the main tag' }),
    ).toBeNull()
    await user.keyboard('{ArrowDown}')
    expect(personal).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(
      screen.getByRole('menuitem', { name: 'Make Personal the main tag' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('menuitem', { name: 'Make Family the main tag' }),
    ).toBeNull()
    await user.click(family)
    await user.click(
      screen.getByRole('menuitem', { name: 'Make Family the main tag' }),
    )

    expect(personal).toHaveAttribute('aria-checked', 'true')
    expect(family).toHaveAttribute('aria-checked', 'true')
    expect(
      screen.getByRole('menuitem', { name: 'Make Family the main tag' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      document.querySelector(
        '.record-tag-ribbon [aria-label="Family, main tag"]',
      ),
    ).toBeVisible()
    expect(
      document.querySelector('.record-tag-ribbon')?.firstElementChild,
    ).toContainElement(
      document.querySelector(
        '.record-tag-ribbon [data-semantic-tag-id="family"]',
      ),
    )
    expect(
      family.querySelector('.record-tag-picker__check svg'),
    ).toBeInTheDocument()
  })

  it('opens from a displayed tag, matches the full tag area, and restores that opener', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function mockBounds(this: HTMLElement) {
        if (this.classList.contains('record-tag-picker__assigned')) {
          return rect(72, 120, 412, 29)
        }
        if (this.classList.contains('record-tag-menu')) {
          return rect(0, 0, 412, 404)
        }
        return rect(0, 0, 0, 0)
      },
    )
    const user = userEvent.setup()

    localised(
      <RecordTagPicker
        tags={{ ordered: ['personal'], display: 'personal' }}
        onChange={vi.fn()}
      />,
    )
    const displayedTag = screen.getByRole('button', {
      name: 'Personal, main tag',
    })
    const add = screen.getByRole('button', { name: 'Manage tags' })

    await user.click(displayedTag)
    const menu = screen.getByRole('menu', { name: 'Choose tags' })
    await waitFor(() => expect(menu).toHaveAttribute('data-ready', 'true'))
    expect(menu).toHaveStyle({
      '--record-overlay-left': '72px',
      '--record-overlay-anchor-width': '412px',
    })
    expect(displayedTag).toHaveAttribute('aria-expanded', 'true')
    expect(add).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')
    await waitFor(() => expect(displayedTag).toHaveFocus())
  })
})
