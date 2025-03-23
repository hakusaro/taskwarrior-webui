import * as Router from '@koa/router';
import { execSync } from 'child_process';

import taskwarrior from './taskwarrior';
import { Task } from "taskwarrior-lib";

const router = new Router();

router.get('/', async ctx => {
	try {
		// Get the active context information first
		const contextInfo = execSync('task context').toString().trim();
		console.log('Context info at task load:', contextInfo);
		
		const activeContext = contextInfo.split('\n')
			.find(line => line.includes('yes'))
			?.split(/\s+/)[0] || 'none';
		
		console.log(`Active context detected: ${activeContext}`);
		
		// Get tasks using export command with explicit context filter
		// "rc.context=1" ensures the context filter is applied
		const tasksJson = execSync('task rc.context=1 export').toString();
		const tasksFromCli = JSON.parse(tasksJson);
		
		// Log task count for debugging
		console.log(`Loaded ${tasksFromCli.length} tasks with context: ${activeContext}`);
		
		// Send both tasks and context info to the client
		ctx.body = {
			tasks: tasksFromCli,
			context: activeContext
		};
	} catch (error) {
		console.error('Error loading tasks:', error);
		ctx.status = 500;
		ctx.body = { error: 'Failed to load tasks' };
	}
});

router.put('/', async ctx => {
	const body = ctx.request.body as { tasks: Task[] };
	const msg = taskwarrior.update(body.tasks);
	console.log(msg);
	ctx.status = 200;
});

router.delete('/', async ctx => {
	try {
		const tasks = ctx.query.tasks as string[];
		// Use taskwarrior library for deleting tasks
		const msg = taskwarrior.del(tasks.map(t => ({ uuid: t })));
		console.log(msg);
		ctx.status = 200;
	} catch (error) {
		console.error('Error deleting tasks:', error);
		ctx.status = 500;
		ctx.body = { error: 'Failed to delete tasks' };
	}
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
			console.log('Context set to none');
		} else {
			execSync(`task context ${contextName}`);
			console.log(`Context set to ${contextName}`);
		}
		
		// Log the active context
		const contextInfo = execSync('task context').toString().trim();
		console.log('Context info:', contextInfo);
		
		// Get tasks after context switch with explicit context filter
		// "rc.context=1" ensures the context filter is applied
		const tasksJson = execSync('task rc.context=1 export').toString();
		const tasks = JSON.parse(tasksJson);
		
		// Log task count for debugging
		const taskCount = tasks.length;
		console.log(`Loaded ${taskCount} tasks with context: ${contextName}`);
		
		ctx.status = 200;
		ctx.body = { 
			success: true, 
			context: contextName,
			tasks
		};
	} catch (error) {
		console.error('Error setting context:', error);
		ctx.status = 500;
		ctx.body = { error: 'Failed to set context' };
	}
});

export default router;