/**
 * Test script to validate NDJSON streaming from /api/chat endpoint.
 *
 * Input data sources: POST request to http://localhost:3000/api/chat
 * Output destinations: Console logs
 * Dependencies: Node.js fetch API
 * Key exports: None (executable script)
 * Side effects: Makes HTTP requests to local dev server
 */

async function testChatStream() {
  console.log('🚀 Testing /api/chat NDJSON streaming endpoint...\n');

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'List the files in the current directory. Be concise.'
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log(`✓ Response status: ${response.status}`);
    console.log(`✓ Content-Type: ${response.headers.get('content-type')}\n`);

    if (!response.body) {
      throw new Error('No response body received');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let messageCount = 0;

    console.log('📥 Streaming messages:\n');
    console.log('─'.repeat(80));

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('\n' + '─'.repeat(80));
        console.log('✓ Stream completed\n');
        break;
      }

      // Accumulate chunks and split by newlines
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            messageCount++;

            console.log(`\n[Message ${messageCount}] Type: ${message.type}`);

            // Display key information based on message type
            if (message.type === 'error') {
              console.log(`  ❌ Error message:`);
              console.log(`  ${JSON.stringify(message, null, 4)}`);
            } else if (message.type === 'system') {
              console.log(`  Subtype: ${message.subtype}`);
              if (message.subtype === 'init') {
                console.log(`  Model: ${message.model}`);
                console.log(`  Tools: ${message.tools.length} available`);
                console.log(`  Session ID: ${message.session_id}`);
              }
            } else if (message.type === 'assistant') {
              console.log(`  Session ID: ${message.session_id}`);
              console.log(`  Content blocks: ${message.message.content.length}`);
              message.message.content.forEach((block: any, i: number) => {
                if (block.type === 'text') {
                  console.log(`    [${i}] Text: ${block.text.substring(0, 100)}${block.text.length > 100 ? '...' : ''}`);
                } else if (block.type === 'tool_use') {
                  console.log(`    [${i}] Tool: ${block.name}`);
                  console.log(`        Input: ${JSON.stringify(block.input).substring(0, 80)}...`);
                }
              });
            } else if (message.type === 'user') {
              console.log(`  Session ID: ${message.session_id}`);
              console.log(`  Role: ${message.message.role}`);
            } else if (message.type === 'result') {
              console.log(`  Subtype: ${message.subtype}`);
              console.log(`  Session ID: ${message.session_id}`);
              console.log(`  Duration: ${message.duration_ms}ms`);
              console.log(`  Turns: ${message.num_turns}`);
              console.log(`  Cost: $${message.total_cost_usd.toFixed(4)}`);
              console.log(`  Usage: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`);
              if (message.subtype === 'success') {
                console.log(`  Result: ${message.result.substring(0, 200)}${message.result.length > 200 ? '...' : ''}`);
              }
            }
          } catch (parseError) {
            console.error('❌ Failed to parse line:', line);
            console.error('   Error:', parseError);
          }
        }
      }
    }

    console.log(`✅ Test completed successfully!`);
    console.log(`📊 Total messages received: ${messageCount}`);

  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testChatStream();
