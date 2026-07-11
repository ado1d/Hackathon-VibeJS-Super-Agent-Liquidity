import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('uses text as well as color', () => {
    const markup = renderToStaticMarkup(<StatusBadge value="data_issue" />)
    expect(markup).toContain('data issue')
  })
})
