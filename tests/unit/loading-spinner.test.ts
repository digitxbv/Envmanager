import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'

describe('LoadingSpinner Component', () => {
  it('should render with default size (h-8 w-8)', () => {
    const wrapper = mount(LoadingSpinner)

    const icon = wrapper.find('[name="lucide:loader-2"]')
    expect(icon.exists()).toBe(true)
    expect(icon.classes()).toContain('h-8')
    expect(icon.classes()).toContain('w-8')
  })

  it('should render with size="sm" (h-6 w-6)', () => {
    const wrapper = mount(LoadingSpinner, {
      props: {
        size: 'sm'
      }
    })

    const icon = wrapper.find('[name="lucide:loader-2"]')
    expect(icon.exists()).toBe(true)
    expect(icon.classes()).toContain('h-6')
    expect(icon.classes()).toContain('w-6')
  })

  it('should always have animate-spin and text-primary classes', () => {
    const wrapper = mount(LoadingSpinner)

    const icon = wrapper.find('[name="lucide:loader-2"]')
    expect(icon.classes()).toContain('animate-spin')
    expect(icon.classes()).toContain('text-primary')
  })
})
