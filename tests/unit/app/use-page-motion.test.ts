import { describe, expect, it } from 'vitest'
import {
  applyPageTransitionRootState,
  resolvePageTransitionName,
} from '~~/app/composables/use-page-motion'

describe('resolvePageTransitionName', () => {
  it('uses auth transition for auth routes', () => {
    expect(resolvePageTransitionName('/login')).toBe('page-shell-auth')
    expect(resolvePageTransitionName('/register')).toBe('page-shell-auth')
  })

  it('uses standard transition for immersive routes', () => {
    expect(resolvePageTransitionName('/chat')).toBe('page-shell')
    expect(resolvePageTransitionName('/chat?id=abc')).toBe('page-shell')
    expect(resolvePageTransitionName('/workspace-documents')).toBe('page-shell')
  })

  it('uses the standard transition for shell pages', () => {
    expect(resolvePageTransitionName('/')).toBe('page-shell')
    expect(resolvePageTransitionName('/dashboard')).toBe('page-shell')
    expect(resolvePageTransitionName('/repository')).toBe('page-shell')
  })
})

describe('applyPageTransitionRootState', () => {
  it('sets the page transition state on root elements', () => {
    const element = document.createElement('html')

    applyPageTransitionRootState(element, true)
    expect(element.dataset.pageTransition).toBe('running')

    applyPageTransitionRootState(element, false)
    expect(element.dataset.pageTransition).toBe('idle')
  })
})
