import * as Router from '@koa/router';
import { execSync } from 'child_process';

import taskwarrior from './taskwarrior';
import { Task } from "taskwarrior-lib";

const router = new Router();

router.get('/', async ctx => {
	const tasks = taskwarrior.load();
	ctx.body = tasks;
});

router.put('/', async ctx => {
	const body = ctx.request.body as { tasks: Task[] };
	const msg = taskwarrior.update(body.tasks);
	console.log(msg);
	ctx.status = 200;
});

router.delete('/', async ctx => {
	const tasks = ctx.query.tasks as string[];
	const msg = taskwarrior.del(tasks.map(t => ({ uuid: t })));
	console.log(msg);
	ctx.status = 200;
});

// Get all available contexts
router.get('/contexts', async ctx => {
	try {
		// Use task CLI command to get contexts
		const contextList = execSync('task _context').toString().trim();
		const activeContext = execSync('task context').toString().trim()
			.split('\n')
			.find(line => line.includes('yes'))
			?.split(/\s+/)[0] || 'none';
		
		// Parse the context list into an array
		const contexts = contextList.split('\n')
			.filter(c => c.trim() !== '')
			.map(c => c.trim());
		
		// Add 'none' context if not already in the list
		if (!contexts.includes('none')) {
			contexts.unshift('none');
		}
		
		ctx.body = {
			contexts,
			active: activeContext
		};
	} catch (error) {
		console.error('Error getting contexts:', error);
		ctx.status = 500;
		ctx.body = { error: 'Failed to get contexts' };
	}
});

// Set active context
router.post('/context/:name', async ctx => {
	try {
		const contextName = ctx.params.name;
		
		if (contextName === 'none') {
			execSync('task context none');
		} else {
			execSync(`task context ${contextName}`);
		}
		
		ctx.status = 200;
		ctx.body = { success: true, context: contextName };
	} catch (error) {
		console.error('Error setting context:', error);
		ctx.status = 500;
		ctx.body = { error: 'Failed to set context' };
	}
});

export default router;
