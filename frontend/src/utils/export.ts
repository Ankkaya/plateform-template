export interface CsvColumn<T> {
  title: string
  value: keyof T | ((row: T) => string | number | boolean | null | undefined)
}

const normalizeCsvValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return ''
  }

  const text = String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

export function exportCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  const header = columns.map(column => normalizeCsvValue(column.title)).join(',')
  const body = rows.map(row => columns.map((column) => {
    const value = typeof column.value === 'function'
      ? column.value(row)
      : row[column.value]
    return normalizeCsvValue(value)
  }).join(','))

  const blob = new Blob([`\uFEFF${[header, ...body].join('\n')}`], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
