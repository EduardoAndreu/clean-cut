import React from 'react'

interface PipelineLabelProps {
  text?: string
}

function PipelineLabel({ text = 'In Pipeline' }: PipelineLabelProps): React.JSX.Element {
  return (
    <div className="absolute -top-3 -right-3 text-xs font-semibold px-3 py-1 rounded-md border shadow-sm">
      {text}
    </div>
  )
}

export default PipelineLabel
