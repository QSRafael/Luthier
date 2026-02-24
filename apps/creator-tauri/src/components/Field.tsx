type FieldProps = {
  label: string
  help: string
  value: string
  onInput: (value: string) => void
}

export default function Field(props: FieldProps) {
  return (
    <label class="field">
      <div class="label-row">
        <span>{props.label}</span>
        <span class="help" title={props.help}>
          ?
        </span>
      </div>
      <input value={props.value} onInput={(e) => props.onInput(e.currentTarget.value)} />
    </label>
  )
}
