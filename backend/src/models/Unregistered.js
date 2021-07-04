import { v4 as uuid } from 'uuid'

export default {
  id: { type: 'string', primary: true, default: uuid }, // TODO: should be type: 'uuid' but simplified for our tests
  name: { type: 'string', disallow: [null], min: 3 },
  lastName: { type: 'string', disallow: [null], min: 3 },
  identification: { type: 'string', required: false, default: 'Not Assigned' },
  country: { type: 'string', required: false, default: 'Not Assigned' },
  gender: { type: 'number', required: false },
  age: { type: 'number', required: false },
  phone: { type: 'string', required: false, default: 'Not Assigned' },
  email: { type: 'string', required: false, default: 'Not Assigned' },
  otherInfo: { type: 'string', required: false, default: 'Not Assigned' },
  createdAt: { type: 'string', isoDate: true, default: () => new Date().toISOString() },
  updatedAt: {
    type: 'string',
    isoDate: true,
    required: true,
    default: () => new Date().toISOString(),
  },
}
