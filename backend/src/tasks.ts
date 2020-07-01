import * as Router from '@koa/router';

import taskwarrior from './taskwarrior';

const router = new Router();

router.get('/', async ctx => {
	const tasks = taskwarrior.load();
	ctx.body = tasks;
});

router.post('/', async ctx => {
	const msg = taskwarrior.update(ctx.body);
	console.log(msg);
	ctx.status = 200;
});

router.put('/', async ctx => {
	const msg = taskwarrior.update(ctx.body);
	console.log(msg);
	ctx.status = 200;
});

router.delete('/', async ctx => {
	const tasks = ctx.query.tasks;
	console.log(tasks);
	/*
	const msg = taskwarrior.update(tasks);
	console.log(msg);
	*/
	ctx.status = 200;
});

export default router;
