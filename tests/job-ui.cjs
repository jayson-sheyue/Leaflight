// Open a completed result deliberately, as a user does in the asynchronous inbox.
exports.openResult=async(page,type)=>{
 await page.waitForFunction(async type=>{const r=await window.leaflight.call('jobs');const latest=r.value.filter(j=>j.type===type).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];return latest?.status==='completed';},type);
 const job=await page.evaluate(async type=>(await window.leaflight.call('jobs')).value.filter(j=>j.type===type).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0],type);
 if(!await page.locator('.inbox').count())await page.locator('[data-action=inbox]').first().click();
 await page.locator(`[data-job="${job.id}"] [data-action=view-job]`).click();
};
