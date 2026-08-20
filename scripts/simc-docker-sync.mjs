import { syncSimcDockerV1, simcDockerFreshnessV1 } from '../server/loot/simc-docker-manager-v1.mjs';

const args=new Set(process.argv.slice(2));
const force=args.has('--force'),statusOnly=args.has('--status'),preflight=args.has('--preflight');
console.log('\nSimulationCraft Docker manager');
console.log('Policy: resolve the official nightly commit, checkout that exact simulationcraft/simc source, and build/run the official Dockerfile locally. Downloaded Windows nightly executables are not used.');

if(preflight){const state=await simcDockerFreshnessV1();console.log(JSON.stringify({mode:'docker-preflight',networkExecuted:false,...state},null,2));if(state.current)console.log(`\nSIMC READY · ${state.current.imageTag} · ${state.current.commit}`);else if(state.docker?.ready)console.warn('\nSIMC OFFLINE: Docker is ready but no verified source image has been built yet. Run npm run sync:simc.');else console.warn(`\nSIMC OFFLINE: ${state.docker?.reason||'Docker is not ready.'}`);process.exit(0);}
if(statusOnly){const state=await simcDockerFreshnessV1();console.log(JSON.stringify(state,null,2));process.exit(state.current?0:2);}
const result=await syncSimcDockerV1({force});console.log(JSON.stringify(result,null,2));if(result.current)console.log(`\nREADY: ${result.current.imageTag} · commit ${result.current.commit}`);else{console.error(`\nSIMC DOCKER WORKER NOT READY: ${result.error?.message||result.docker?.reason||result.status}`);process.exitCode=2;}
