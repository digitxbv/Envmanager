import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PageHeader from '~/components/ui/PageHeader.vue'

describe('PageHeader Component', () => {
  it('should render title as h1 with correct classes', () => {
    const wrapper = mount(PageHeader, {
      props: {
        title: 'Test Title'
      }
    })

    const h1 = wrapper.find('h1')
    expect(h1.exists()).toBe(true)
    expect(h1.text()).toBe('Test Title')
    expect(h1.classes()).toContain('text-2xl')
    expect(h1.classes()).toContain('font-semibold')
    expect(h1.classes()).toContain('tracking-tight')
    expect(h1.classes()).toContain('text-foreground')
  })

  it('should render description when provided', () => {
    const wrapper = mount(PageHeader, {
      props: {
        title: 'Test Title',
        description: 'Test Description'
      }
    })

    const p = wrapper.find('p')
    expect(p.exists()).toBe(true)
    expect(p.text()).toBe('Test Description')
    expect(p.classes()).toContain('text-sm')
    expect(p.classes()).toContain('text-muted-foreground')
  })

  it('should not render description when not provided', () => {
    const wrapper = mount(PageHeader, {
      props: {
        title: 'Test Title'
      }
    })

    const p = wrapper.find('p')
    expect(p.exists()).toBe(false)
  })

  it('should render #actions slot content when provided', () => {
    const wrapper = mount(PageHeader, {
      props: {
        title: 'Test Title'
      },
      slots: {
        actions: '<button>Action Button</button>'
      }
    })

    expect(wrapper.text()).toContain('Action Button')
  })

  it('should apply flex wrapper when #actions slot is used', () => {
    const wrapper = mount(PageHeader, {
      props: {
        title: 'Test Title'
      },
      slots: {
        actions: '<button>Action</button>'
      }
    })

    const rootDiv = wrapper.find('div')
    expect(rootDiv.classes()).toContain('flex')
    expect(rootDiv.classes()).toContain('flex-col')
    expect(rootDiv.classes()).toContain('gap-3')
  })

  it('should not apply flex wrapper when no #actions slot', () => {
    const wrapper = mount(PageHeader, {
      props: {
        title: 'Test Title'
      }
    })

    const rootDiv = wrapper.find('div')
    expect(rootDiv.classes()).not.toContain('flex')
  })
})
