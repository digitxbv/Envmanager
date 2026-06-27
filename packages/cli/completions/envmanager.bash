_envmanager_completions() {
  local cur prev words cword
  _init_completion || return

  local completions
  completions=$(envmanager __complete "${COMP_WORDS[@]:1}" 2>/dev/null)
  
  if [[ $? -eq 0 ]]; then
    COMPREPLY=($(compgen -W "$completions" -- "$cur"))
  fi
}

complete -F _envmanager_completions envmanager
