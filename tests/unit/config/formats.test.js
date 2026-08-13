import { email, ipaddress, url } from '../../../src/config/formats.js'

describe('#emailFormat', () => {
  test('Should coerce a value to a string', () => {
    expect(email.coerce('test@example.com')).toBe('test@example.com')
  })

  test('Should not throw for a valid email address', () => {
    expect(() => email.validate('test@example.com')).not.toThrow()
  })

  test('Should throw for an invalid email address', () => {
    expect(() => email.validate('not-an-email')).toThrow(
      'must be an email address'
    )
  })
})

describe('#ipaddressFormat', () => {
  test('Should coerce a value to a string', () => {
    expect(ipaddress.coerce('127.0.0.1')).toBe('127.0.0.1')
  })

  test('Should not throw for a valid IP address', () => {
    expect(() => ipaddress.validate('127.0.0.1')).not.toThrow()
  })

  test('Should throw for an invalid IP address', () => {
    expect(() => ipaddress.validate('not-an-ip')).toThrow(
      'must be an IP address'
    )
  })
})

describe('#urlFormat', () => {
  test('Should coerce a value to a string', () => {
    expect(url.coerce('https://example.com')).toBe('https://example.com')
  })

  test('Should not throw for a valid URL', () => {
    expect(() => url.validate('https://example.com')).not.toThrow()
  })

  test('Should throw for an invalid URL', () => {
    expect(() => url.validate('not a url')).toThrow('must be a URL')
  })
})
