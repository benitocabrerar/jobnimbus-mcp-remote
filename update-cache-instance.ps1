# PowerShell script to add instance parameter to withCache calls
# This adds 'instance: context.instance,' after the identifier line

$files = @(
    "src/tools/account/getAccountSettings.ts",
    "src/tools/account/getUoms.ts",
    "src/tools/account/getUsers.ts",
    "src/tools/activities/getActivities.ts",
    "src/tools/activities/getActivity.ts",
    "src/tools/attachments/getAttachments.ts",
    "src/tools/attachments/getFileById.ts",
    "src/tools/budgets/getBudgets.ts",
    "src/tools/contacts/getContact.ts",
    "src/tools/contacts/getContacts.ts",
    "src/tools/contacts/searchContacts.ts",
    "src/tools/estimates/getEstimate.ts",
    "src/tools/estimates/getEstimates.ts",
    "src/tools/financials/getConsolidatedFinancials.ts",
    "src/tools/invoices/getInvoices.ts",
    "src/tools/jobs/getJobs.ts",
    "src/tools/jobs/searchJobs.ts",
    "src/tools/materialorders/getMaterialOrder.ts",
    "src/tools/materialorders/getMaterialOrders.ts",
    "src/tools/payments/getPayments.ts",
    "src/tools/products/getProduct.ts",
    "src/tools/products/getProducts.ts",
    "src/tools/tasks/getTask.ts",
    "src/tools/tasks/getTasks.ts",
    "src/tools/workorders/getWorkOrder.ts",
    "src/tools/workorders/getWorkOrders.ts"
)

foreach ($file in $files) {
    Write-Host "Processing: $file"

    $content = Get-Content $file -Raw

    # Pattern to match: identifier: something, followed by closing brace or next property
    # We want to add instance: context.instance after the identifier line

    $pattern = '(identifier:\s*[^,\n]+,)\s*\n(\s*)(})'
    $replacement = '$1' + "`n" + '$2instance: context.instance,' + "`n" + '$2$3'

    $newContent = $content -replace $pattern, $replacement

    if ($newContent -ne $content) {
        Set-Content -Path $file -Value $newContent -NoNewline
        Write-Host "  Updated: $file" -ForegroundColor Green
    } else {
        Write-Host "  No changes: $file" -ForegroundColor Yellow
    }
}

Write-Host "`nDone! Updated all files."
