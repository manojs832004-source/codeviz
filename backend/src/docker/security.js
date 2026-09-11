function getSecurityFlags() {
  return [
    '--network=none',
    '--memory=128m',
    '--read-only',
    '--cap-drop=ALL',
    '--pids-limit=50',
    '--cpus=0.5'
  ];
}

module.exports = {
  getSecurityFlags
};
