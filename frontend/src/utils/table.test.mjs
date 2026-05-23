import assert from 'node:assert/strict'
import test from 'node:test'
import {
  autoFitTableColumns,
  createActionColumn,
  createIndexColumn,
  normalizeTableHeaderAlign,
} from './table.ts'

test('creates a stable index column for normal tables', () => {
  const column = createIndexColumn()

  assert.equal(column.title, '序号')
  assert.equal(column.key, '__index')
  assert.equal(column.width, 70)
  assert.equal(column.titleAlign, 'left')
  assert.equal(column.align, 'center')
  assert.equal(column.render({}, 0), 1)
  assert.equal(column.render({}, 9), 10)
})

test('creates a page-aware index column when a start offset is provided', () => {
  const column = createIndexColumn(() => 20)

  assert.equal(column.render({}, 0), 21)
  assert.equal(column.render({}, 4), 25)
})

test('keeps table headers left aligned while preserving body alignment', () => {
  const columns = autoFitTableColumns([
    { title: '状态', key: 'status', align: 'center' },
    createActionColumn({ title: '操作', key: 'actions', align: 'center' }, 2),
  ])

  assert.equal(columns[0].titleAlign, 'left')
  assert.equal(columns[0].align, 'center')
  assert.equal(columns[1].titleAlign, 'left')
  assert.equal(columns[1].align, 'center')
})

test('normalizes all data table headers to left alignment', () => {
  const columns = normalizeTableHeaderAlign([
    { title: '状态', key: 'status', titleAlign: 'center', align: 'center' },
    {
      title: '分组',
      key: 'group',
      titleAlign: 'center',
      children: [
        { title: '名称', key: 'name', titleAlign: 'center' },
      ],
    },
    { type: 'selection', titleAlign: 'center' },
  ])

  assert.equal(columns[0].titleAlign, 'left')
  assert.equal(columns[0].align, 'center')
  assert.equal(columns[1].titleAlign, 'left')
  assert.equal(columns[1].children[0].titleAlign, 'left')
  assert.equal(columns[2].titleAlign, 'center')
})
