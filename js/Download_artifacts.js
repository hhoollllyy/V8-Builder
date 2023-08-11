var fs = require('fs');
module.exports = async function (github, context) {
    var total_slept = 0;
    var downloaded_files = [];
    var seen_completed_wfs = [];
    var platforms = ['windows', 'linux', 'android', 'macos', 'ios'];
    var expected_to_see = platforms.length;
    var tickInterval = 30000;
    while (total_slept < 10800000 && seen_completed_wfs.length < expected_to_see) {
        var all_workflows = await github.rest.actions.listWorkflowRunsForRepo({
            owner: context.repo.owner,
            repo: context.repo.repo,
        });
        console.log("Expecting to download from " + expected_to_see + " workflows, currently at " + seen_completed_wfs.length + ".\nHave already downloaded " + downloaded_files.length + " files as " + downloaded_files);
        for (const workflow of all_workflows.data.workflow_runs) {
            if (workflow.head_sha == `${ github.sha }`) {
                console.log(`found ${ workflow.name } ${ workflow.status }`)
                if (workflow.status == "completed") {
                    if (seen_completed_wfs.includes(workflow.name)) continue;
                    if (platforms.find(v => workflow.name.toLowerCase().includes(v)) == null) continue;
                    if (workflow.conclusion == "success") {
                        var artifacts = await github.rest.actions.listWorkflowRunArtifacts({
                            owner: context.repo.owner,
                            repo: context.repo.repo,
                            run_id: workflow.id,
                            per_page: 100,
                        });
                        for (const artifact of artifacts.data.artifacts) {
                            if (!fs.existsSync(`${ github.workspace }/bin`)) {
                                fs.mkdirSync(`${ github.workspace }/bin`, {
                                    recursive: true
                                });
                            }
                            var fn = `${ github.workspace }/bin/${ artifact.name }.zip`;
                            if (downloaded_files.includes(fn)) continue;
                            var download = await github.rest.actions.downloadArtifact({
                                owner: context.repo.owner,
                                repo: context.repo.repo,
                                artifact_id: artifact.id,
                                archive_format: 'zip',
                            });
                            fs.writeFileSync(fn, Buffer.from(download.data));
                            downloaded_files.push(fn);
                        }
                        seen_completed_wfs.push(workflow.name);
                    }
                }
            }
        }
        if (seen_completed_wfs.length < expected_to_see) {
            console.log("sleeping " + tickInterval);
            await new Promise(r => setTimeout(r, tickInterval));
            total_slept = total_slept + tickInterval;
            console.log("done sleeping " + tickInterval);
        }
    }
    console.log(downloaded_files);
    return downloaded_files;
}