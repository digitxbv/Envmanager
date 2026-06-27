function __fish_envmanager_complete
  set -l tokens (commandline -opc)
  set -l current (commandline -ct)
  envmanager __complete $tokens[2..-1] $current 2>/dev/null
end

complete -c envmanager -f -a '(__fish_envmanager_complete)'
