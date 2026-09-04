// Mirrors Python's logging.basicConfig(level=INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
function timestamp() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function info(msg) {
  console.log(`${timestamp()} - server - INFO - ${msg}`);
}

function warn(msg) {
  console.warn(`${timestamp()} - server - WARNING - ${msg}`);
}

function error(msg) {
  console.error(`${timestamp()} - server - ERROR - ${msg}`);
}

module.exports = { info, warn, error };
